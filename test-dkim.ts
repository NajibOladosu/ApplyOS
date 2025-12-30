import { config } from 'dotenv';
import path from 'path';

// Load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const { sendEmailViaSMTP } = await import('./lib/email/transport');

    const recipient = 'najibibrahim7@gmail.com';
    console.log(`Sending DKIM-signed test email to: ${recipient}`);

    try {
        const result = await sendEmailViaSMTP(
            recipient,
            '🛡️ ApplyOS DKIM Signature Test',
            '<h1>DKIM Signing Enabled!</h1><p>Your emails are now being digitally signed with your private key. This should significantly improve deliverability to Gmail.</p>'
        );

        if (result && result.messageId) {
            console.log('\n🚀 SUCCESS: Signed test email sent successfully!');
            console.log(`Message ID: ${result.messageId}`);
        } else {
            console.log('\n❌ FAILED: Could not send signed test email.');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 ERROR during sending:');
        console.error(error);
        process.exit(1);
    }
}

main();
