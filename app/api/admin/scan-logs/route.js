import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";

// In-memory storage for scan logs (in production, use Redis or Database)
let scanLogs = [];
const MAX_LOGS = 1000; // Keep last 1000 logs in memory

export async function GET(req) {
  try {
    // PERBAIKAN: Check for internal request header untuk GET requests juga
    const isInternalRequest = req.headers.get('X-Internal-Request') === 'true';
    console.log('[SCAN-LOGS-GET] Internal request:', isInternalRequest);
    
    if (isInternalRequest) {
      console.log('[SCAN-LOGS-GET] Bypassing auth for internal GET request');
    } else {
      // Normal authentication untuk external GET requests
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      await connectToDatabase();
      const user = await User.findOne({ email: session.user.email });
      if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit")) || 50;
    const gateId = searchParams.get("gateId");
    const status = searchParams.get("status"); // VALID, INVALID
    const timeRange = searchParams.get("timeRange"); // today, hour, all

    // Filter logs
    let filteredLogs = [...scanLogs];

    if (gateId) {
      filteredLogs = filteredLogs.filter(log => log.gateId === gateId);
    }

    if (status) {
      filteredLogs = filteredLogs.filter(log => log.verificationResult === status);
    }

    if (timeRange) {
      const now = new Date();
      let cutoff;
      
      if (timeRange === "hour") {
        cutoff = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour ago
      } else if (timeRange === "today") {
        cutoff = new Date(now.setHours(0, 0, 0, 0)); // Start of today
      }
      
      if (cutoff) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= cutoff
        );
      }
    }

    // Sort by newest first and limit
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    filteredLogs = filteredLogs.slice(0, limit);

    // Generate dashboard stats
    const stats = generateDashboardStats(scanLogs);

    return NextResponse.json({
      logs: filteredLogs,
      stats,
      totalLogs: scanLogs.length,
      filteredCount: filteredLogs.length
    });

  } catch (error) {
    console.error("Get scan logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    console.log('[SCAN-LOGS-API] ========== RECEIVING LOG ==========');
    
    // PERBAIKAN: Check for internal request header first
    const isInternalRequest = req.headers.get('X-Internal-Request') === 'true';
    console.log('[SCAN-LOGS-API] Internal request:', isInternalRequest);
    
    if (isInternalRequest) {
      console.log('[SCAN-LOGS-API] Bypassing auth for internal request');
    } else {
      // Normal authentication for external requests
      const session = await getServerSession(authOptions);
      console.log('[SCAN-LOGS-API] Session check:', session?.user?.email ? 'VALID' : 'INVALID');
      
      if (!session?.user?.email) {
        console.log('[SCAN-LOGS-API] No session - returning 401');
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      await connectToDatabase();
      const user = await User.findOne({ email: session.user.email });
      console.log('[SCAN-LOGS-API] User lookup:', user?.email, 'Role:', user?.role);
      
      if (!user || user.role !== "admin") {
        console.log('[SCAN-LOGS-API] Access denied - not admin');
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const body = await req.json();
    console.log('[SCAN-LOGS-API] Received body:', body);
    
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...body
    };

    console.log('[SCAN-LOGS-API] Created log entry:', logEntry);

    // Add to logs array
    scanLogs.unshift(logEntry);
    console.log('[SCAN-LOGS-API] Added to logs array. Total logs:', scanLogs.length);
    
    // Keep only recent logs to prevent memory issues
    if (scanLogs.length > MAX_LOGS) {
      scanLogs = scanLogs.slice(0, MAX_LOGS);
      console.log('[SCAN-LOGS-API] Trimmed logs to MAX_LOGS:', MAX_LOGS);
    }

    console.log(`[SCAN-LOG-STORED] ${JSON.stringify(logEntry)}`);
    console.log('[SCAN-LOGS-API] ========== LOG STORED SUCCESSFULLY ==========');

    return NextResponse.json({ 
      success: true, 
      logId: logEntry.id,
      totalLogs: scanLogs.length,
      message: "Scan log stored successfully"
    });

  } catch (error) {
    console.error("[SCAN-LOGS-API] Store scan log error:", error);
    console.error("[SCAN-LOGS-API] Error stack:", error.stack);
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

function generateDashboardStats(logs) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
  const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

  const recentLogs = logs.filter(log => new Date(log.timestamp) >= oneHourAgo);
  const todayLogs = logs.filter(log => new Date(log.timestamp) >= oneDayAgo);

  const validScans = logs.filter(log => log.verificationResult === 'VALID');
  const invalidScans = logs.filter(log => log.verificationResult === 'INVALID');

  // Gate activity
  const gateActivity = logs.reduce((acc, log) => {
    const gate = log.gateId || 'UNKNOWN';
    acc[gate] = (acc[gate] || 0) + 1;
    return acc;
  }, {});

  // Crew activity
  const crewActivity = logs.reduce((acc, log) => {
    const crew = log.crewEmail || log.crewId || 'UNKNOWN';
    acc[crew] = (acc[crew] || 0) + 1;
    return acc;
  }, {});

  // Hourly distribution (last 24 hours)
  const hourlyStats = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - (i * 60 * 60 * 1000));
    const hourStart = new Date(hour);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + (60 * 60 * 1000));
    
    const hourLogs = logs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime >= hourStart && logTime < hourEnd;
    });

    hourlyStats.push({
      hour: hourStart.getHours(),
      count: hourLogs.length,
      valid: hourLogs.filter(log => log.verificationResult === 'VALID').length,
      invalid: hourLogs.filter(log => log.verificationResult === 'INVALID').length
    });
  }

  return {
    totalScans: logs.length,
    recentScans: recentLogs.length, // Last hour
    todayScans: todayLogs.length,
    validScans: validScans.length,
    invalidScans: invalidScans.length,
    successRate: logs.length > 0 ? ((validScans.length / logs.length) * 100).toFixed(1) : 0,
    gateActivity,
    crewActivity,
    hourlyStats,
    lastScanTime: logs.length > 0 ? logs[0].timestamp : null
  };
}