import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from "@react-email/components";

interface WelcomeEmailProps {
  name: string;
  dashboardUrl?: string;
}

const BRAND_PRIMARY = "#3b82f6";

export default function WelcomeEmail({
  name,
  dashboardUrl = "https://learn-up-qmgx.onrender.com/dashboard",
}: WelcomeEmailProps) {
  const firstName = name ? name.split(" ")[0] : "Estudiante";

  return (
    <Html>
      <Head />
      <Preview>¡Bienvenido a Learn Up!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://learn-up-qmgx.onrender.com/icon-512.png"
              width="64"
              height="64"
              alt="Learn Up"
              style={logoStyle}
            />
            <Heading style={brandText}>🎓 Learn Up</Heading>
          </Section>

          <Heading style={h1}>¡Bienvenido a Learn Up!</Heading>
          <Text style={paragraph}>Hola, {firstName} 👋</Text>
          <Text style={paragraph}>
            Tu cuenta de Learn Up ya está lista. Estamos felices de tenerte aquí.
          </Text>
          <Text style={paragraph}>
            Aprende, practica y organiza tus estudios con las herramientas de Learn Up,
            diseñadas para acompañarte durante tu aprendizaje.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={dashboardUrl}>
              Ir a Learn Up
            </Button>
          </Section>

          <Text style={shortMessage}>Tu espacio de aprendizaje comienza aquí.</Text>

          <Hr style={hr} />
          <Text style={footer}>
            © Learn Up · Profetas del Código
            <br />
            Este correo fue enviado porque se creó una cuenta en Learn Up.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f8fafc",
  fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};
const container = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "40px 32px",
  borderRadius: 16,
  maxWidth: 520,
  border: "1px solid #e2e8f0",
};
const header = { textAlign: "center" as const, marginBottom: 32 };
const logoStyle = { margin: "0 auto", borderRadius: "20%" };
const brandText = {
  fontSize: 26,
  fontWeight: 800,
  color: "#0f172a",
  margin: "14px 0 0",
};
const h1 = {
  fontSize: 24,
  fontWeight: 700,
  color: "#1e293b",
  margin: "0 0 24px",
};
const paragraph = {
  fontSize: 15,
  lineHeight: "26px",
  color: "#475569",
  margin: "0 0 16px",
};
const buttonSection = { textAlign: "center" as const, margin: "32px 0" };
const button = {
  backgroundColor: BRAND_PRIMARY,
  borderRadius: 10,
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600,
  textDecoration: "none",
  padding: "14px 32px",
  display: "inline-block",
};
const shortMessage = {
  fontSize: 14,
  lineHeight: "24px",
  color: "#64748b",
  textAlign: "center" as const,
  margin: "0",
};
const hr = { borderColor: "#e2e8f0", margin: "32px 0 24px" };
const footer = {
  fontSize: 12,
  lineHeight: "20px",
  color: "#94a3b8",
  textAlign: "center" as const,
};
