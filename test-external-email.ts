import { config } from 'dotenv';
import path from 'path';

// Load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const { sendEmailViaSMTP } = await import('./lib/email/transport');

    const recipient = 'najibibrahim7@gmail.com';
    console.log(`Sending test email to: ${recipient}`);

    try {
        const result = await sendEmailViaSMTP(
            recipient,
            '🧪 ApplyOS External Delivery Test',
            '<h1>Delivery Test Successful!</h1><p>This email confirms that <strong>ApplyOS</strong> can send emails externally via PrivateEmail.com.</p>'
        );

        if (result && result.messageId) {
            console.log('\n🚀 SUCCESS: Test email sent successfully!');
            console.log(`Message ID: ${result.messageId}`);
        } else {
            console.log('\n❌ FAILED: Could not send test email.');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 ERROR during sending:');
        console.error(error);
        process.exit(1);
    }
}

main();
