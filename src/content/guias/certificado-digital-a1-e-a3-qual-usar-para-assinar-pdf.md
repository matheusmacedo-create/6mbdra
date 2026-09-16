---
title: "Certificado digital A1 ou A3: qual usar para assinar PDF"
description: "A diferença entre certificado A1 (arquivo) e A3 (cartão, token ou nuvem) para assinar petições em PDF, prós e contras de cada um e o que fazer quando vence."
updated: 2026-09-16
tags:
  - assinatura digital
  - ICP-Brasil
  - certificado digital
---

Antes de assinar uma petição em PDF, o certificado digital precisa estar instalado e válido — e a primeira dúvida de quem tira o certificado pela primeira vez é qual tipo escolher. A diferença entre A1 e A3 não é de marca ou preço: é de **onde a chave privada fica guardada**, e isso muda como o certificado é usado no dia a dia.

## A1: arquivo no computador

O certificado A1 é um arquivo (`.pfx` ou `.p12`) instalado diretamente no computador ou no navegador, protegido por uma senha. Para assinar um PDF, o programa lê esse arquivo local — não precisa de cartão, leitora nem internet no momento da assinatura.

Vantagens: instala em minutos, funciona em qualquer computador onde o arquivo for copiado, não depende de hardware. Desvantagem: a validade é de **1 ano**, e o arquivo pode ser copiado — por isso a senha é a única proteção real, e vale mantê-la só com quem vai assinar.

## A3: cartão, token ou nuvem

O certificado A3 guarda a chave dentro de uma mídia criptográfica: um cartão com leitora, um token USB, ou — cada vez mais comum — um certificado em nuvem acessado por aplicativo com biometria ou QR code. A chave privada nunca sai do hardware (ou do servidor da nuvem), então copiar o certificado sem o dispositivo físico ou o segundo fator não é possível.

Vantagens: mais seguro contra cópia, validade de até **5 anos** nas modalidades em nuvem (3 anos nas físicas), aceito nos mesmos sistemas que o A1. Desvantagem: cartão e token exigem leitora e instalação de driver — um problema recorrente em computador novo ou em plantão fora do escritório. A versão em nuvem resolve isso: assina pelo celular, sem instalar nada no computador que está sendo usado.

## Os dois assinam com o mesmo valor jurídico

Para o peticionamento eletrônico, A1 e A3 têm **exatamente o mesmo efeito legal** — os tribunais não diferenciam um do outro, porque ambos são certificados ICP-Brasil e geram a mesma assinatura PAdES. A escolha é só sobre praticidade e segurança, não sobre validade da petição. Veja [PAdES e as siglas AD-RB, AD-RT, AD-RC e AD-RA](/guias/pades-e-as-siglas-ad-rb-ad-rt-ad-rc-ad-ra/) para o que muda na política de assinatura em si.

## Qual escolher

| Situação | Recomendação |
| --- | --- |
| Um só computador, uso diário no escritório | A1 — mais simples, sem hardware |
| Assina em vários computadores ou em plantão | A3 em nuvem — não depende de onde o certificado está instalado |
| Exige o máximo de proteção contra vazamento | A3 físico (cartão ou token) |
| Escritório com vários advogados assinando | A3 em nuvem, um por pessoa — evita compartilhar arquivo `.pfx` por e-mail |

## Certificado vencido não assina — nem some do PDF já assinado

Um certificado vencido não permite gerar **novas** assinaturas, mas não invalida as assinaturas já feitas com ele enquanto estavam válidas: a verificação usa o carimbo de tempo do momento da assinatura, não a data de hoje. Se o sistema recusar o envio por causa disso, o problema não é o PDF — é renovar o certificado antes de assinar a próxima petição. Veja [assinatura inválida ou documento alterado](/guias/assinatura-invalida-ou-documento-alterado-o-que-fazer/) para os outros motivos de recusa.

## Depois de assinar

Assinar e comprimir na ordem errada quebra a assinatura — qualquer alteração no arquivo depois de assinado invalida o PAdES. Comprima o PDF **antes** de assinar, nunca depois. Veja [por que comprimir antes de assinar digitalmente](/guias/por-que-comprimir-antes-de-assinar-digitalmente/) para o fluxo completo.

## Leia também

- [PAdES e as siglas AD-RB, AD-RT, AD-RC e AD-RA](/guias/pades-e-as-siglas-ad-rb-ad-rt-ad-rc-ad-ra/)
- [Assinatura eletrônica e assinatura digital: qual a diferença](/guias/assinatura-eletronica-e-assinatura-digital-a-diferenca/)
- [Como verificar a assinatura digital de um PDF](/guias/como-verificar-a-assinatura-digital-de-um-pdf/)
