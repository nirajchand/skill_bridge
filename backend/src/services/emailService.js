/**
 * Dev email service — logs to the console. Swap the `send` body for
 * SendGrid/Mailgun later without changing callers.
 */

function send(to, subject, body) {
  console.log(`\n📧 EMAIL TO ${to}\n   Subject: ${subject}\n   ${body}\n`);
}

module.exports = {
  sendPaymentFundedEmail: (freelancerEmail, taskName, amount) =>
    send(freelancerEmail, 'Payment funded', `Escrow funded for "${taskName}" ($${amount}). You can start work.`),
  sendWorkSubmittedEmail: (clientEmail, taskName, freelancerName) =>
    send(clientEmail, 'Work submitted', `${freelancerName} submitted work for "${taskName}". Please review.`),
  sendWorkApprovedEmail: (freelancerEmail, taskName, amount) =>
    send(freelancerEmail, 'Work approved', `Your work on "${taskName}" was approved. $${amount} released to your balance.`),
  sendRevisionRequestedEmail: (freelancerEmail, taskName, notes) =>
    send(freelancerEmail, 'Revision requested', `The client requested a revision on "${taskName}": ${notes}`),
  sendDisputeRaisedEmail: (toEmail, taskName, reason) =>
    send(toEmail, 'Dispute raised', `A dispute was raised on "${taskName}" (reason: ${reason}).`),
  sendPayoutProcessedEmail: (freelancerEmail, amount) =>
    send(freelancerEmail, 'Payout processed', `Your payout of $${amount} has been processed.`)
};
