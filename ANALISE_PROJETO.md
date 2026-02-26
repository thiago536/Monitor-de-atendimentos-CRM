# 📂 Deep Dive: Arquitetura Técnica Sitegen Tech

Este documento detalha as decisões de design, fluxos de dados e infraestrutura que compõem o ecossistema Sitegen Tech. Esta documentação é voltada para desenvolvedores e arquitetos que desejam entender as entranhas do sistema.

---

## 🏗️ Design de Sistema

O Sitegen Tech utiliza uma arquitetura distribuída, onde a inteligência está na borda (extensão) e a consolidação no núcleo (API/Supabase).

### Fluxo de Dados de Atendimento
1.  **Monitoramento (Frontend CRM)**: O `content.js` utiliza `MutationObserver` com filtros específicos para evitar overhead de CPU. A captura é baseada em eventos de DOM que indicam início/fim de tickets.
2.  **Processamento Local**: Aplicação de Regex otimizados para classificação de motivos e status antes de enviar para a API.
3.  **Transporte de Dados**: Envio via HTTPS/REST para o `ServidorAPI`. No desenvolvimento, utiliza-se placeholders para URLs (`http://sua-api-url.com/api`).
4.  **Backend (Lógica de Gamificação)**: O `server.js` processa os rankings baseados em tempo de resposta (NPS projetado) e volume.
5.  **Persistência (Supabase)**: Utilização de PostgreSQL nativo. As queries de ranking são otimizadas via visualizações e agregações (ver `/sql`).

---

## 🛡️ Segurança e Infraestrutura

### Secret Management
O sistema foi completamente migrado para o padrão **Twelve-Factor App**:
- **Variáveis de Ambiente**: Arquivo `.env` centraliza chaves do Supabase e credenciais SMTP.
- **Anonimização**: Código fonte em produção não contém emails reais ou IPs locais.
- **Git Hygiene**: `.gitignore` robusto que protege dependências, segredos e logs.

### Resiliência (Heartbeat)
Para garantir a precisão dos rankings, implementamos um sistema de **Heartbeat Confiável**:
- A extensão envia sinais a cada 30 segundos.
- O backend monitora o "Last Seen" dos atendentes.
- Se um atendente fica offline, o ranking é ajustado automaticamente para evitar distorções.

---

## 🗄️ Estrutura de Dados (Pasta /sql)
Os schemas estão organizados por funcionalidade:
- `monitor-atendentes-schema.sql`: Tabela principal de status em tempo real.
- `alertas-schema.sql`: Engine de alertas inteligentes.
- `db_add_origin_column.sql`: Lógica de diferenciação entre Atendimento Ativo vs Receptivo.

---

## 🎯 Conclusão da Limpeza Profissional
O projeto foi submetido a uma auditoria rigorosa de segurança:
- [x] Remoção de credenciais hardcoded.
- [x] Exclusão de arquivos `.md` de instruções da IA.
- [x] Limpeza de pastas de backup e arquivos temporários.
- [x] Organização estrutural de esquemas SQL.

---
*Documento gerado como parte da entrega final de profissionalização técnica.*
