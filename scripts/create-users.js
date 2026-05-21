const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

/**
 * 检查用户账户是否已完善激活
 * 激活条件：密码已修改(mustChangePassword=false) + 有邮箱 + 有电话
 */
function isAccountActivated(user) {
  return !user.mustChangePassword && !!user.email && !!user.phone;
}

async function main() {
  try {
    // 定义要创建的用户（密码 = 用户名）
    const usersToCreate = [
      { username: 'recipient1', roleCode: 'RECIPIENT' },
      { username: 'recipient2', roleCode: 'RECIPIENT' },
      { username: 'teacher1', roleCode: 'TEACHER' },
    ];

    console.log('开始创建/更新用户...\n');
    console.log('📌 新激活流程：');
    console.log('   - 初始密码 = 用户名');
    console.log('   - 账户默认不启用');
    console.log('   - 用户需修改密码 + 填写邮箱 + 填写电话后自动激活\n');

    for (const userData of usersToCreate) {
      // 检查用户是否已存在
      const existingUser = await prisma.user.findUnique({ 
        where: { username: userData.username } 
      });

      // 获取角色
      const role = await prisma.role.findUnique({ 
        where: { code: userData.roleCode } 
      });

      if (!role) {
        console.log(`❌ 角色 "${userData.roleCode}" 不存在`);
        continue;
      }

      // 密码 = 用户名
      const passwordHash = await bcrypt.hash(userData.username, 10);

      if (existingUser) {
        // 更新现有用户为新激活流程
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            isActive: false,
            mustChangePassword: true,
            email: null,
            phone: null
          }
        });
        console.log(`🔄 更新用户 "${userData.username}":`);
        console.log(`   密码已重置为用户名`);
        console.log(`   账户已设为待激活状态`);
        console.log('');
      } else {
        // 创建新用户
        await prisma.user.create({
          data: {
            username: userData.username,
            passwordHash,
            isActive: false,
            mustChangePassword: true,
            roles: {
              create: [{ roleId: role.id }]
            }
          }
        });

        console.log(`✅ 创建用户成功:`);
        console.log(`   用户名: ${userData.username}`);
        console.log(`   初始密码: ${userData.username}`);
        console.log(`   角色: ${role.name} (${userData.roleCode})`);
        console.log(`   状态: ⏳ 待激活`);
        console.log('');
      }
    }

    // 显示所有用户
    console.log('\n========== 所有用户列表 ==========\n');
    const allUsers = await prisma.user.findMany({
      include: {
        roles: {
          include: { role: true }
        }
      }
    });

    console.log('用户名\t\t| 角色\t\t| 激活状态\t| 密码\t| 邮箱\t| 电话');
    console.log('-'.repeat(80));
    
    allUsers.forEach(user => {
      const roles = user.roles.map(r => r.role.name).join(', ');
      const activated = isAccountActivated(user);
      const status = activated ? '✅ 已激活' : '⏳ 待激活';
      const pwd = user.mustChangePassword ? '❌ 未改' : '✅ 已改';
      const email = user.email ? '✅' : '❌';
      const phone = user.phone ? '✅' : '❌';
      console.log(`${user.username}\t\t| ${roles}\t| ${status}\t| ${pwd}\t| ${email}\t| ${phone}`);
    });

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

