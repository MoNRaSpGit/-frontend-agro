import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

// Sin esto, un error de render en cualquier parte de la app (un .find()
// sobre un id que ya no existe, una fecha mal formada, etc.) desmonta todo
// el arbol de React y el cliente se queda con una pantalla en blanco, sin
// ningun mensaje ni forma de saber que paso.
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[app-error-boundary]", error, errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main style={containerStyle}>
        <section style={cardStyle}>
          <h1 style={titleStyle}>Algo salio mal</h1>
          <p style={messageStyle}>
            La app encontro un error inesperado y no puede seguir mostrando esta pantalla. Tus datos ya guardados no se
            pierden por esto. Recarga la pagina para continuar.
          </p>
          <button type="button" onClick={this.handleReload} style={buttonStyle}>
            Recargar pagina
          </button>
        </section>
      </main>
    );
  }
}

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "#f7fff9"
};

const cardStyle: React.CSSProperties = {
  maxWidth: 420,
  padding: "28px 24px",
  borderRadius: 12,
  border: "1px solid rgba(21, 92, 63, 0.2)",
  background: "#ffffff",
  boxShadow: "0 14px 34px rgba(19, 45, 33, 0.16)",
  textAlign: "center"
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  color: "#163225"
};

const messageStyle: React.CSSProperties = {
  margin: "0 0 20px",
  color: "#3c4f45",
  lineHeight: 1.5
};

const buttonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "0 20px",
  borderRadius: 8,
  border: "1px solid rgba(21, 92, 63, 0.2)",
  background: "#2b7a57",
  color: "#f8fffb",
  fontWeight: 800,
  cursor: "pointer"
};
