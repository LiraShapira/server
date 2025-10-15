import { Request, Response } from "express";
import { CheckVerifyRequest, TwilioCheckVerifyResponse, StartVerifyRequest, TwilioStartVerifyResponse } from "../../types/twilioTypes";

type RequestBody<T> = Request<{}, {}, T>;

export const startVerify = async (req: RequestBody<StartVerifyRequest>, res: Response) => {
  const { phoneNumber } = req.body;

  // Check if using new Twilio Verify API or legacy TWILIO_URL
  const useNewAPI = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID;
  const useLegacyAPI = process.env.TWILIO_URL;

  if (!useNewAPI && !useLegacyAPI) {
    console.error('Missing Twilio environment variables');
    return res.status(500).json({ 
      success: false, 
      error: 'Server configuration error: Missing Twilio credentials' 
    });
  }

  try {
    let response;
    
    if (useNewAPI) {
      // Use new Twilio Verify API
      const data = new URLSearchParams({
        To: phoneNumber,
        Channel: "sms",
      });

      response = await fetch(
        `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
          },
          body: data
        }
      );
    } else {
      // Use legacy TWILIO_URL
      const data = JSON.stringify({
        to: phoneNumber,
        channel: "sms",
      });

      response = await fetch(`${process.env.TWILIO_URL}/start-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: data
      });
    }

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Twilio API error (${response.status}):`, errorText);
      return res.status(400).json({ 
        success: false, 
        error: `Twilio API error: ${response.status} ${response.statusText}` 
      });
    }

    // Try to parse JSON, but handle cases where response might not be JSON
    let json;
    try {
      json = await response.json();
    } catch (parseError) {
      console.error('Failed to parse Twilio response as JSON:', parseError);
      return res.status(500).json({ 
        success: false, 
        error: 'Invalid response from Twilio service' 
      });
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Error in startVerify:', e);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

export const checkVerify = async (req: RequestBody<CheckVerifyRequest>, res: Response) => {
  const { phoneNumber, code } = req.body;

  // Validate required environment variables
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
    console.error('Missing Twilio environment variables');
    return res.status(500).json({ 
      success: false, 
      error: 'Server configuration error: Missing Twilio credentials' 
    });
  }

  const data = new URLSearchParams({
    To: phoneNumber,
    Code: code,
  });

  try {
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
        },
        body: data,
      }
    );

    const json = await response.json();

    if (!response.ok) {
      console.error('Twilio API error:', json);
      return res.status(400).json({ 
        success: false, 
        error: json.message || 'Failed to verify code' 
      });
    }

    res.status(200).json({ 
      success: json.status === 'approved',
      message: json.status === 'approved' ? 'Verification successful' : 'Verification failed'
    });
  } catch (e) {
    console.error('Error in checkVerify:', e);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
