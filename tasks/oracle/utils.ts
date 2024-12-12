import inquirer from "inquirer";

export async function confirmRenounce(options: {
  type: 'role' | 'admin';
  contract: string;
  role?: string;
  address: string;
}): Promise<boolean> {
  const { type, contract, role, address } = options;

  console.log(`\n⚠️  WARNING: You are about to renounce ${type === 'admin' ? 'the admin role' : 'a role'} ⚠️\n`);
  console.log("This action:");
  console.log("- Is IRREVERSIBLE");
  console.log(`- Will ${type === 'admin' ? 'PERMANENTLY ' : ''}remove your ${type} privileges`);
  console.log("- Cannot be recovered unless an admin grants it back");
  console.log("\nContract:", contract);
  if (role) console.log("Role:", role);
  console.log("Your address:", address);

  const { confirmed } = await inquirer.prompt([
    {
      type: 'input',
      name: 'confirmed',
      message: 'Type "RENOUNCE" to confirm this irreversible action:',
      validate: (input: string) => {
        if (input === 'RENOUNCE') {
          return true;
        }
        return 'Please type "RENOUNCE" to confirm or Ctrl+C to cancel';
      }
    }
  ]);

  return confirmed === 'RENOUNCE';
} 