import React from 'react';
import {
    Html,
    Body,
    Container,
    Head,
    Hr,
    Img,
    Preview,
    Row,
    Section,
    Text,
    Link,
} from '@react-email/components';
import { ApplyOSButton } from './components/button';
import { ApplyOSLogo } from './components/logo';

interface ResetPasswordProps {
    userName: string;
    resetUrl: string;
}

export const ResetPasswordTemplate: React.FC<ResetPasswordProps> = ({
    userName,
    resetUrl,
}) => {
    const year = new Date().getFullYear();

    return (
        <Html>
            <Preview>Reset your ApplyOS password</Preview>
            <Body
                style={{
                    backgroundColor: '#0A0A0A',
                    color: '#EDEDED',
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
                }}
            >
                <Container
                    style={{
                        maxWidth: '600px',
                        margin: '0 auto',
                        padding: '20px',
                    }}
                >
                    {/* Header with gradient background */}
                    <Section
                        style={{
                            background: 'linear-gradient(135deg, #00FF88 0%, #00CC66 100%)',
                            borderRadius: '12px 12px 0 0',
                            padding: '40px 20px',
                            textAlign: 'center',
                        }}
                    >
                        <ApplyOSLogo width={40} height={40} />
                        <Text
                            style={{
                                fontSize: '28px',
                                fontWeight: '700',
                                color: '#000000',
                                margin: '10px 0 10px 0',
                            }}
                        >
                            Reset Your Password
                        </Text>
                        <Text
                            style={{
                                fontSize: '14px',
                                color: '#1A1A1A',
                                margin: '0',
                            }}
                        >
                            Restore access to your ApplyOS account
                        </Text>
                    </Section>

                    {/* Main content */}
                    <Section
                        style={{
                            backgroundColor: '#101010',
                            padding: '40px 30px',
                            borderRadius: '0 0 12px 12px',
                        }}
                    >
                        {/* Greeting */}
                        <Text
                            style={{
                                fontSize: '16px',
                                margin: '0 0 20px 0',
                                color: '#EDEDED',
                                lineHeight: '1.5',
                            }}
                        >
                            Hi {userName},
                        </Text>

                        {/* Main message */}
                        <Text
                            style={{
                                fontSize: '14px',
                                margin: '0 0 20px 0',
                                color: '#B5B5B5',
                                lineHeight: '1.6',
                            }}
                        >
                            We received a request to reset the password for your ApplyOS account. If you didn't make this request, you can safely ignore this email.
                        </Text>

                        {/* Reset button */}
                        <Row
                            style={{
                                margin: '30px 0',
                                textAlign: 'center',
                            }}
                        >
                            <ApplyOSButton href={resetUrl}>
                                Reset Password
                            </ApplyOSButton>
                        </Row>

                        {/* Fallback link */}
                        <Text
                            style={{
                                fontSize: '12px',
                                color: '#808080',
                                margin: '20px 0',
                                textAlign: 'center',
                            }}
                        >
                            If the button above doesn't work, copy and paste this link into your browser:
                        </Text>
                        <Text
                            style={{
                                fontSize: '12px',
                                color: '#00FF88',
                                margin: '10px 0 30px 0',
                                textAlign: 'center',
                                wordBreak: 'break-all',
                            }}
                        >
                            <Link
                                href={resetUrl}
                                style={{
                                    color: '#00FF88',
                                    textDecoration: 'underline',
                                }}
                            >
                                {resetUrl}
                            </Link>
                        </Text>

                        <Hr
                            style={{
                                borderColor: '#1A1A1A',
                                margin: '30px 0',
                            }}
                        />

                        {/* Security info */}
                        <Text
                            style={{
                                fontSize: '12px',
                                color: '#808080',
                                margin: '20px 0',
                                lineHeight: '1.5',
                            }}
                        >
                            <strong>Security Note:</strong> This password reset link expires in 24 hours. For your security, never share this link with anyone.
                        </Text>
                    </Section>

                    {/* Footer */}
                    <Section
                        style={{
                            backgroundColor: '#0A0A0A',
                            padding: '20px',
                            textAlign: 'center',
                            borderTop: '1px solid #1A1A1A',
                            marginTop: '20px',
                        }}
                    >
                        <Text
                            style={{
                                fontSize: '12px',
                                color: '#808080',
                                margin: '0 0 10px 0',
                            }}
                        >
                            © {year} ApplyOS. All rights reserved.
                        </Text>
                        <Text
                            style={{
                                fontSize: '11px',
                                color: '#606060',
                                margin: '0',
                            }}
                        >
                            Questions? Contact support at{' '}
                            <Link
                                href="mailto:support@applyos.io"
                                style={{
                                    color: '#00FF88',
                                    textDecoration: 'none',
                                }}
                            >
                                support@applyos.io
                            </Link>
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default ResetPasswordTemplate;
