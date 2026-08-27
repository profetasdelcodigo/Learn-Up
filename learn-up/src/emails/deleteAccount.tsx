import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Img,
} from "@react-email/components";
import * as React from "react";

interface DeleteAccountEmailProps {
  userFirstName: string;
}

export const DeleteAccountEmail = ({
  userFirstName,
}: DeleteAccountEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Confirmación de eliminación de cuenta - Learn Up</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Lamentamos verte partir, {userFirstName}</Heading>
          
          <Text style={text}>
            Te confirmamos que tu cuenta en <strong>Learn Up</strong> ha sido eliminada permanentemente.
          </Text>
          
          <Text style={text}>
            De acuerdo con nuestros Términos de Servicio y Políticas de Privacidad, todos tus datos personales, progreso de estudio y configuraciones han sido purgados de nuestros sistemas.
          </Text>

          <Text style={text}>
            Si esto fue un error o si decides volver en el futuro, siempre serás bienvenido/a. Solo tendrás que registrarte nuevamente.
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              Atentamente,<br />
              El equipo de Learn Up
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default DeleteAccountEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  borderRadius: "8px",
  border: "1px solid #eee",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  padding: "0",
  margin: "0 0 20px",
};

const text = {
  color: "#555",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const footer = {
  marginTop: "40px",
  borderTop: "1px solid #eee",
  paddingTop: "20px",
};

const footerText = {
  color: "#888",
  fontSize: "14px",
  lineHeight: "24px",
};
