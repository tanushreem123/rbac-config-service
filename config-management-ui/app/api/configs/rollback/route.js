import { NextResponse } from "next/server";
import { rollbackConfig } from "@/lib/ConfigService";

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await rollbackConfig(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
