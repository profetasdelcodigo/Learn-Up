import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ConfirmSignupEmailProps {
  recipientEmail: string;
  confirmationUrl: string;
}

export default function ConfirmSignupEmail({
  recipientEmail,
  confirmationUrl,
}: ConfirmSignupEmailProps) {
  const firstName = recipientEmail.split("@")[0]?.split(/[._-]/)[0] || "estudiante";
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <Html>
      <Head />
      <Preview>Confirma tu correo y completa tu registro en Learn Up.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ textAlign: "center", marginBottom: 28 }}>
            <Img
              src="https://learn-up-qmgx.onrender.com/icon-512.png"
              width="64"
              height="64"
              alt="Learn Up"
              style={logoStyle}
            />
            <Heading style={brandText}>Learn Up</Heading>
          </Section>

          <Heading style={h1}>¡Hola, {displayName}! 👋</Heading>
          <Text style={paragraph}>
            Tu cuenta de Learn Up está casi lista. Solo necesitamos confirmar que este correo te pertenece.
          </Text>
          <Text style={paragraph}>
            Después de confirmar podrás volver a Learn Up y completar tu perfil para comenzar a usar la plataforma.
          </Text>

          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button style={button} href={confirmationUrl}>
              Confirmar mi correo
            </Button>
          </Section>

          <Text style={smallText}>
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </Text>
          <Text style={linkText}>{confirmationUrl}</Text>

          <Hr style={hr} />
          <Text style={footer}>
            Este correo fue enviado porque se inició un registro en Learn Up con {recipientEmail}.
            Si no fuiste tú, puedes ignorarlo.
          </Text>
          <Text style={footer}>El equipo de Learn Up</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#0a0a0b",
  fontFamily: "Inter, Helvetica Neue, Helvetica, Arial, sans-serif",
};
const container = {
  backgroundColor: "#151517",
  margin: "40px auto",
  padding: "40px 32px",
  borderRadius: 18,
  maxWidth: 560,
  border: "1px solid #29292d",
};
const logoStyle = { margin: "0 auto", borderRadius: 16 };
const brandText = {
  fontSize: 28,
  fontWeight: 800,
  color: "#f8fafc",
  margin: "14px 0 0 0",
  letterSpacing: "-0.5px",
};
const h1 = {
  fontSize: 24,
  fontWeight: 700,
  color: "#f8fafc",
  margin: "0 0 20px 0",
};
const paragraph = {
  fontSize: 15,
  lineHeight: "26px",
  color: "#cbd5e1",
  margin: "0 0 16px 0",
};
const button = {
  backgroundColor: "#f0c850",
  borderRadius: 10,
  color: "#0a0a0b",
  fontSize: 15,
  fontWeight: 700,
  textDecoration: "none",
  padding: "14px 30px",
  display: "inline-block",
};
const smallText = {
  fontSize: 12,
  lineHeight: "18px",
  color: "#94a3b8",
  margin: "0 0 8px 0",
};
const linkText = {
  fontSize: 11,
  lineHeight: "18px",
  color: "#94a3b8",
  wordBreak: "break-all" as const,
};
const hr = { borderColor: "#2d2d33", margin: "30px 0 20px 0" };
const footer = {
  fontSize: 12,
  lineHeight: "19px",
  color: "#64748b",
  margin: "0 0 8px 0",
};
