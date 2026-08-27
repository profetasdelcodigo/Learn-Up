import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";

if (publicKey && privateKey && publicKey.length > 0 && privateKey.length > 0) {
  try {
    webpush.setVapidDetails("mailto:soporte@learnup.com", publicKey, privateKey);
  } catch (error) {
    console.warn("VAPID keys provided are invalid. Push notifications disabled.", error);
  }
} else {
  console.warn("Push notifications disabled: VAPID keys are missing.");
}

export default webpush;
