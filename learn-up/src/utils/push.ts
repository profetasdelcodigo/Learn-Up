import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails("mailto:soporte@learnup.com", publicKey, privateKey);
} else {
  console.warn("Push notifications disabled: VAPID keys are missing.");
}

export default webpush;
