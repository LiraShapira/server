import { Request, Response } from "express";
import { CheckVerifyRequest, TwilioCheckVerifyResponse, StartVerifyRequest, TwilioStartVerifyResponse } from "../../types/twilioTypes";

type RequestBody<T> = Request<{}, {}, T>;

export const startVerify = async (req: RequestBody<StartVerifyRequest>, res: Response) => {
  const data = JSON.stringify({
    to: req.body.phoneNumber,
    channel: "sms",
  });

  try {

    const response = await fetch(`${process.env.TWILIO_URL}/start-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data
    });
    const json: TwilioStartVerifyResponse = await response.json();

    res.status(200).send(json);
  } catch (e) {
    console.log(e);
    res.status(400).send(e);
  }
}

export const checkVerify = async (req: RequestBody<CheckVerifyRequest>, res: Response) => {
  try {
    const data = JSON.stringify({
      to: req.body.phoneNumber,
      code: req.body.code
    });

    const response = await fetch(`${process.env.TWILIO_URL}/check-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data,
    });

    const json: TwilioCheckVerifyResponse = await response.json();

    res.status(200).send(json);
  } catch (e) {
    console.log(e)
  }
}
