import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text, Button,
} from "@react-email/components";

interface WelcomeEmailProps {
  name: string;
  dashboardUrl?: string;
}

const BRAND_PRIMARY = "#3b82f6"; // Blue-500

export default function WelcomeEmail({
  name,
  dashboardUrl = "https://learn-up-qmgx.onrender.com/dashboard",
}: WelcomeEmailProps) {
  // Extraemos el primer nombre por si el usuario se registró con nombre completo
  const firstName = name ? name.split(" ")[0] : "Estudiante";

  return (
    <Html>
      <Head />
      <Preview>¡Bienvenido a Learn Up, {firstName}! 🚀 Tu nueva aventura académica te espera.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ textAlign: "center", marginBottom: 32 }}>
            <Img src="https://learn-up-qmgx.onrender.com/icon-512.png" width="72" height="72" alt="Learn Up Logo" style={logoStyle} />
            <Heading style={brandText}>Learn Up</Heading>
          </Section>
          
          <Heading style={h1}>¡Hola, {firstName}! 👋</Heading>
          
          <Text style={paragraph}>
            Estamos muy emocionados de darte la bienvenida oficial a <strong>Learn Up</strong>. Acabas de dar el primer paso hacia una nueva y revolucionaria forma de aprender, diseñada específicamente para adaptarse a tu ritmo y estilo.
          </Text>

          <Text style={paragraph}>
            A partir de ahora, tendrás acceso a rutas de aprendizaje inteligentes, simuladores de exámenes dinámicos y a <strong>Jarvis</strong>, tu profesor particular de Inteligencia Artificial que estará disponible 24/7 para resolver cualquier duda que tengas.
          </Text>

          <Section style={{ textAlign: "center", margin: "36px 0" }}>
            <Button style={button} href={dashboardUrl}>
              Empezar mi aventura ahora
            </Button>
          </Section>

          <Text style={paragraph}>
            Si tienes alguna sugerencia o necesitas ayuda en cualquier momento, siempre puedes comunicarte con nosotros respondiendo a este correo. ¡Estamos aquí para ayudarte a brillar! ✨
          </Text>
          
          <Hr style={hr} />
          
          <Text style={footer}>
            Con mucho cariño,<br/>
            <strong>El equipo de Learn Up</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f8fafc", fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif" };
const container = { backgroundColor: "#ffffff", margin: "40px auto", padding: "40px 32px", borderRadius: 16, maxWidth: 520, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" };
const logoStyle = { margin: "0 auto", borderRadius: "20%" };
const brandText = { fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "16px 0 0 0", letterSpacing: "-0.5px" };
const h1 = { fontSize: 22, fontWeight: 700, color: "#1e293b", margin: "0 0 20px 0" };
const paragraph = { fontSize: 15, lineHeight: "26px", color: "#475569", margin: "0 0 16px 0" };
const button = { backgroundColor: BRAND_PRIMARY, borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none", padding: "14px 32px", display: "inline-block", boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.39)" };
const hr = { borderColor: "#e2e8f0", margin: "32px 0 24px 0" };
const footer = { fontSize: 14, color: "#64748b", textAlign: "left" as const, lineHeight: "24px" };
