const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'felipe@agenciab16.com.br';
  const password = 'Fkbs1990@134821';
  
  console.log(`Verificando se o usuário raiz "${email}" existe...`);
  
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  if (existingUser) {
    console.log('Usuário raiz encontrado. Atualizando senha e garantindo papel SUPERADMIN...');
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        role: 'SUPERADMIN',
      },
    });
    console.log('Usuário raiz atualizado com sucesso.');
  } else {
    console.log('Criando novo usuário raiz com acesso SUPERADMIN...');
    await prisma.user.create({
      data: {
        name: 'Felipe Belloni',
        email,
        passwordHash,
        role: 'SUPERADMIN',
      },
    });
    console.log('Usuário raiz criado com sucesso.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
