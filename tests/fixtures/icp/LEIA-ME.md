# Certificados reais da ICP-Brasil, para teste

Baixados de `http://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/ACcompactado.zip`
em 16/09/2026. São autoridades certificadoras públicas — não há nada sigiloso num certificado, que
é justamente o objeto feito para ser distribuído.

Estão aqui porque uma cadeia de teste própria não prova nada sobre a ICP-Brasil: provaria só que o
código valida certificados que o próprio código gerou. Com estes, o teste verifica o depósito de
raízes embutido contra assinaturas reais do ITI.

| arquivo | o que prova |
|---|---|
| `ac-prime-v5.crt` | caminho RSA comum, ancorando na Raiz v5 — é como 95% da hierarquia funciona |
| `ac-certisign-g4.crt` | outro ramo, ancorando na Raiz v10 |
| `inmetro-ed25519.crt` | ramo Ed25519 (raiz v6): tem que virar "não verificada", nunca "fora da ICP" |
