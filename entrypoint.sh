#!/bin/sh
# entrypoint.sh

# Define um valor padrão para a variável de ambiente, caso não seja fornecida
export VALIDADOCS_API=${VALIDADOCS_API}

echo "Usando API_URL: $VALIDADOCS_API"

# Cria a pasta de configuração, se não existir
mkdir -p /usr/share/nginx/html/assets/config

# Gera o arquivo config.json com o valor da variável de ambiente
cat <<EOF > /usr/share/nginx/html/assets/config/config.json
{
  "validadocsApi": "${VALIDADOCS_API}"
}
EOF

# Executa o comando original do container (CMD)
exec "$@"