const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // 恢复 admin 用户的激活状态
    await prisma.user.update({
      where: { username: 'admin' },
      data: {
        isActive: true,
        mustChangePassword: false,
        email: 'admin@system.local',
        phone: '000-000-0000'
      }
    });
    
    console.log('✅ Admin 用户已恢复为完全激活状态');
    
    const user = await prisma.user.findUnique({ where: { username: 'admin' } });
    console.log('\nAdmin 用户信息:');
    console.log(`  用户名: ${user.username}`);
    console.log(`  邮箱: ${user.email}`);
    console.log(`  电话: ${user.phone}`);
    console.log(`  激活状态: ${user.isActive ? '已激活' : '未激活'}`);
    console.log(`  需改密码: ${user.mustChangePassword ? '是' : '否'}`);
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();






