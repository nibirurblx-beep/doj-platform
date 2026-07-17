import { logoutAction } from "@/app/auth/actions";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return logoutAction();
}
