<h1 align="center">
  <img src="./Logo%20e%20fotos/logo.jpeg" width="150px" />
  <br>
  Sitegen Tech: Monitor de Atendimentos CRM
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Produção-success?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Stack-Fullstack-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Security-Anonymized-green?style=for-the-badge" />
</p>

<p align="center">
  <strong>Ecossistema inteligente de monitoramento, gamificação e predição para operações de atendimento em larga escala.</strong>
</p>

---

## ✨ Funcionalidades Core

O **Sitegen Tech Monitor** não é apenas uma ferramenta de log; é um motor de eficiência operacional de ponta a ponta.

````carousel
### 📊 Dashboard em Tempo Real
Visualização instantânea da saúde da operação.
![Tela Inicial](/Logo%20e%20fotos/tela%20inicial%20diaria.png)
<!-- slide -->
### 🌍 Inteligência Geográfica
Mapeamento de clientes e distribuição de demanda por região.
![Mapa de Clientes](/Logo%20e%20fotos/Mapa%20de%20clientes.png)
<!-- slide -->
### 🤖 Predição com IA
Algoritmos avançados para prever picos de demanda e gargalos.
![IA Predict](/Logo%20e%20fotos/ia%20predict.png)
<!-- slide -->
### 🏆 Gamificação Profissional
Engajamento da equipe através de rankings e métricas de performance.
![Gamificação](/Logo%20e%20fotos/gameficação%20de%20atendentes.png)
````

---

## 🏗️ Arquitetura Técnica

Projetado para ser robusto, escalável e fácil de integrar:

| Camada | Tecnologia | Papel Crítico |
| :--- | :--- | :--- |
| **Extension** | JavaScript Vanilla | Captura de eventos via `MutationObserver` no CRM. |
| **Backend** | Node.js + Express | Processamento de lógica de negócio e gamificação. |
| **Frontend** | Next.js + Tailwind | Dashboard premium com visualização de dados. |
| **Database** | Supabase (Postgres) | Persistência segura e real-time. |

---

## 🛡️ Segurança e Privacidade

Este repositório foi rigorosamente auditado para garantir a **segurança total** dos dados:
- **Zero Secrets**: Uso mandatório de variáveis de ambiente (`.env`).
- **Anonimização**: Todos os e-mails e metadados de funcionários foram removidos ou substituídos por placeholders.
- **Git Shield**: `.gitignore` configurado para proteger logs, backups e arquivos de ferramentas de agente.

---

## 🚀 Como Executar o Ecossistema

### 1. Backend (ServidorAPI)
```bash
cd ServidorAPI
npm install
# Configure seu .env com SUPABASE_URL e SMTP
node server.js
```

### 2. Frontend (Dashboard)
```bash
cd "frontend atual"
npm install
npm run dev
```

### 3. Extensão (MonitorAtendimento)
1. Abra o Chrome em `chrome://extensions/`
2. Ative o "Modo do Desenvolvedor".
3. Clique em "Carregar sem compactação" e selecione a pasta `MonitorAtendimento`.

---

## 🤝 Contato e Negócios

Este sistema foi desenvolvido pela **Sitegen Tech**. Se você busca soluções personalizadas de automação, monitoramento ou inteligência de dados para o seu negócio, entre em contato.

---
*Transformando dados em decisões estratégicas.*
