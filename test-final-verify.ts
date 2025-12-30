import { config } from 'dotenv';
import path from 'path';

// Load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const { sendEmailViaSMTP } = await import('./lib/email/transport');

    const recipient = 'najibaioladosu@gmail.com';
    console.log(`Sending final DKIM-signed test email to: ${recipient}`);

    try {
        const result = await sendEmailViaSMTP(
            recipient,
            '🧪 ApplyOS Final Delivery Verification',
            '<h1>Final Verification Successful!</h1><p>This email confirms that <strong>ApplyOS</strong> is correctly delivering DKIM-signed emails to your second Gmail address.</p>'
        );

        if (result && result.messageId) {
            console.log('\n🚀 SUCCESS: Email sent successfully!');
            console.log(`Message ID: ${result.messageId}`);
        } else {
            console.log('\n❌ FAILED: Could not send email.');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 ERROR during sending:');
        console.error(error);
        process.exit(1);
    }
}

main();
