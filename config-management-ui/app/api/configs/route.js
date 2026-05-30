import { NextResponse } from "next/server";
import { fetchConfigs, createConfig } from "@/lib/ConfigService";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const env = searchParams.get("env");

  if (!env) {
    return NextResponse.json(
      { error: "env is required" },
      { status: 400 }
    );
  }

  try {
    const configs = await fetchConfigs(env);
    return NextResponse.json(configs);
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await createConfig(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
