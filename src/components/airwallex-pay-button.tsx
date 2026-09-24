"use client";

import { useState } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  intentId: string;
  clientSecret: string;
  currency: string;
  env: "demo" | "prod";
  countryCode: string;
  successUrl: string;
  amountLabel: string;
};

declare global {
  interface Window {
    AirwallexComponentsSDK?: {
      init: (options: { env: string; enabledElements: string[] }) => Promise<{
        payments: { redirectToCheckout: (options: Record<string, unknown>) => void };
      }>;
    };
  }
}

export function AirwallexPayButton(props: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const https = props.successUrl.startsWith("https://");

  async function pay() {
    if (!https) {
      setError("Airwallex requires an HTTPS success URL. Set NEXT_PUBLIC_APP_URL to your https origin.");
      return;
    }
    const sdk = window.AirwallexComponentsSDK;
    if (!sdk) {
      setError("The Airwallex checkout script has not loaded yet.");
      return;
    }
    const { payments } = await sdk.init({ env: props.env, enabledElements: ["payments"] });
    payments.redirectToCheckout({
      env: props.env,
      mode: "payment",
      intent_id: props.intentId,
      client_secret: props.clientSecret,
      currency: props.currency,
      country_code: props.countryCode,
      successUrl: props.successUrl,
    });
  }

  return (
    <div className="space-y-3">
      <Script src="https://static.airwallex.com/components/sdk/v1/index.js" strategy="afterInteractive" onLoad={() => setReady(true)} />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!https ? (
        <Alert>
          <AlertDescription>
            This origin is not HTTPS, so the hosted payment page cannot return here. Use a public https URL in NEXT_PUBLIC_APP_URL.
          </AlertDescription>
        </Alert>
      ) : null}
      <Button type="button" size="lg" onClick={pay} disabled={!ready}>
        {ready ? `Pay ${props.amountLabel} with Airwallex` : "Loading checkout…"}
      </Button>
    </div>
  );
}
