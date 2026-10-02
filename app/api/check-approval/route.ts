import { NextResponse } from "next/server";
import { enforceRateLimit, passthroughResponse, runHandler } from "@/lib/api-handler";
import { NATIVE_TOKEN_ADDRESS } from "@/lib/tokens";
import { uniswapApiFetch } from "@/lib/uniswap-client";
import {
  assertAddress,
  assertBaseUnitsAmount,
  assertSupportedChainId,
  ValidationError,
} from "@/lib/validation";
import type { CheckApprovalRequestBody, CheckApprovalResponse } from "@/lib/types/trading-api";

export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, "check-approval");
  if (limited) return limited;

  return runHandler(async () => {
    const body = await request.json();

    const walletAddress = assertAddress(body.walletAddress, "walletAddress");
    const token = assertAddress(body.token, "token");
    if (token.toLowerCase() === NATIVE_TOKEN_ADDRESS) {
      // El token nativo no se puede aprobar; el cliente debe saltar este paso.
      throw new ValidationError("Native token does not require approval");
    }
    const amount = assertBaseUnitsAmount(body.amount, "amount");
    const chainId = assertSupportedChainId(body.chainId);

    const requestBody: CheckApprovalRequestBody = {
      walletAddress,
      token,
      amount,
      // check_approval espera chainId como number (a diferencia de /quote).
      chainId,
    };

    const result = await uniswapApiFetch<CheckApprovalResponse>("/check_approval", requestBody);
    return passthroughResponse(result);
  });
}
