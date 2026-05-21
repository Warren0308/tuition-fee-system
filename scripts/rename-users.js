const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  try {
    // 用户名映射
    const renames = [
      { oldUsername: 'recipient1', newUsername: 'LingYoke' },
      { oldUsername: 'recipient2', newUsername: 'LingLing' },
      { oldUsername: 'teacher1', newUsername: 'Warren' },
    ];

    console.log('开始重命名用户...\n');

    for (const { oldUsername, newUsername } of renames) {
      const user = await prisma.user.findUnique({ where: { username: oldUsername } });
      
      if (!user) {
        console.log(`⚠️  用户 "${oldUsername}" 不存在，跳过`);
        continue;
      }

      // 检查新用户名是否已存在
      const existingNew = await prisma.user.findUnique({ where: { username: newUsername } });
      if (existingNew) {
        console.log(`⚠️  用户名 "${newUsername}" 已存在，跳过`);
        continue;
      }

      // 更新用户名，密码重置为新用户名
      const passwordHash = await bcrypt.hash(newUsername, 10);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          username: newUsername,
          passwordHash,
          isActive: false,
          mustChangePassword: true
        }
      });

      console.log(`✅ 用户重命名成功:`);
      console.log(`   ${oldUsername} → ${newUsername}`);
      console.log(`   初始密码: ${newUsername}`);
      console.log('');
    }

    // 显示所有用户
    console.log('\n========== 所有用户列表 ==========\n');
    const allUsers = await prisma.user.findMany({
      include: {
        roles: {
          include: { role: true }
        }
      },
      orderBy: { username: 'asc' }
    });

    console.log('用户名\t\t| 角色\t\t| 初始密码\t| 激活状态');
    console.log('-'.repeat(70));
    
    allUsers.forEach(user => {
      const roles = user.roles.map(r => r.role.name).join(', ');
      const activated = !user.mustChangePassword && user.email && user.phone;
      const status = activated ? '✅ 已激活' : '⏳ 待激活';
      const pwd = user.mustChangePassword ? user.username : '(已修改)';
      console.log(`${user.username}\t\t| ${roles}\t| ${pwd}\t| ${status}`);
    });

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();






