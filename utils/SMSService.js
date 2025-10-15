const axios = require("axios");

const EXTService = async (mobile) =>{

    console.log("Mobile in SMS Service:", mobile);

    try {
    const response = await axios.post(
      "http://retailsms.nettyfish.com/api/mt/SendSms",
      null,
      {
        params: {
          User: process.env.SMS_USER,
          Password: process.env.SMS_PASSWORD,
          SenderId: process.env.SMS_SENDERID,
          Channel: process.env.SMS_CHANNEL,
          DCS: 0,
          FlashSms: 0,
          Number: Number(mobile),
          Text: `Dear Customer, Today EXT Service has been completed successfully. Thank you for choosing us - KCATCHU.`,
          DLTTemplateId: `1707176001330659714`,
          api_key: process.env.SMS_API_KEY,
        },
      }
    );
    return "SMS Sent Successfully";
  } catch (error) {
    return error.message;
  }
}

const IntExtService = async (mobile) =>{

    try {
    const response = await axios.post(
      "http://retailsms.nettyfish.com/api/mt/SendSms",
      null,
      {
        params: {
          User: process.env.SMS_USER,
          Password: process.env.SMS_PASSWORD,
          SenderId: process.env.SMS_SENDERID,
          Channel: process.env.SMS_CHANNEL,
          DCS: 0,
          FlashSms: 0,
          Number: Number(mobile),
          Text: `Dear Customer, Today EXT+INT Service has been completed successfully. Thank you for choosing us - KCATCHU.`,
          DLTTemplateId: `1707176001641275381`,
          api_key: process.env.SMS_API_KEY,
        },
      }
    );
    console.log("SMS Response:", response);
    return "SMS Sent Successfully";
  } catch (error) {
    console.error("SMS Error:", error);
    return error.message;
  }
}

module.exports = { EXTService, IntExtService };