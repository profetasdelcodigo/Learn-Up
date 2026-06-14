import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text, Button,
} from "@react-email/components";

interface WelcomeEmailProps {
  name: string;
  dashboardUrl?: string;
}

const BRAND_PRIMARY = "#2563eb"; // Blue-600

export default function WelcomeEmail({
  name,
  dashboardUrl = "https://learnup.app/dashboard",
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Bienvenido a Learn Up, {name} 🎓</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ textAlign: "center", marginBottom: 24 }}>
            <Img src="https://learnup.app/logo.png" width="120" alt="Learn Up" />
          </Section>
          <Heading style={h1}>¡Bienvenido a Learn Up, {name}!</Heading>
          <Text style={paragraph}>
            Tu cuenta ya esta lista. Learn Up te acompaña con rutas de
            aprendizaje personalizadas, seguimiento de progreso y a Jarvis,
            tu asistente de IA, listo para ayudarte en el camino.
          </Text>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button style={button} href={dashboardUrl}>Ir a mi panel</Button>
          </Section>
          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />
          <Text style={footer}>Si no creaste esta cuenta, puedes ignorar este correo.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f6f7", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { backgroundColor: "#fff", margin: "0 auto", padding: 32, borderRadius: 12, maxWidth: 480 };
const h1 = { fontSize: 22, fontWeight: 700, textAlign: "center" as const, color: "#1F2933" };
const paragraph = { fontSize: 15, lineHeight: "24px", color: "#4b5563" };
const button = { backgroundColor: BRAND_PRIMARY, borderRadius: 8, color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none", padding: "12px 28px" };
const footer = { fontSize: 12, color: "#9ca3af", textAlign: "center" as const };
