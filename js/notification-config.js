// The VAPID public key is safe to expose in the customer app.
// Replace this value after generating the VAPID key pair. Keep the matching
// private key only in Supabase Edge Function secrets.
window.ELIM_NOTIFICATION_CONFIG = Object.freeze({
  vapidPublicKey: "BL-zW1Mqquh3p7_f1QGDLpYNP4pKklSjjYt0qLk1gKdr3KE-xkMwZ62gL8uuJrdHPsqLZdvfSGR8zO9oJR5TftE"
});
