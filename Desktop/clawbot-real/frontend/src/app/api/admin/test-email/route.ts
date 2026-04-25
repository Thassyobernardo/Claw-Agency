
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: "RESEND_API_KEY is not set in .env" }, { status: 500 });
    }

    const resend = new Resend(resendKey);

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "EcoLink <noreply@mytradieai.com.au>",
      to: email,
      subject: "🚀 EcoLink System Test",
      html: `
        <div style="font-family:sans-serif;padding:20px;color:#333;">
          <h1 style="color:#16A34A;">System Integration Successful!</h1>
          <p>This is a test email from your EcoLink instance.</p>
          <p><strong>Status:</strong> Active</p>
          <p><strong>Environment:</strong> Development (Localhost)</p>
          <hr/>
          <p style="font-size:12px;color:#999;">EcoLink Australia — AASB S2 Compliance</p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
