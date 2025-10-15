#!/usr/bin/env ts-node

/**
 * Database Integration Test Runner
 * 
 * This script runs comprehensive tests to verify that the new Supabase database
 * is working properly with all API endpoints.
 * 
 * Usage:
 *   npm run test:db
 *   or
 *   ts-node tests/run-db-tests.ts
 */

import { execSync } from 'child_process';
import path from 'path';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command: string, description: string) {
  log(`\n${colors.blue}${description}${colors.reset}`);
  log(`Running: ${command}`);
  
  try {
    const output = execSync(command, { 
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      encoding: 'utf8'
    });
    log(`${colors.green}✓ ${description} completed successfully${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}✗ ${description} failed${colors.reset}`);
    return false;
  }
}

async function main() {
  log(`${colors.bold}${colors.blue}Database Integration Test Suite${colors.reset}`);
  log(`${colors.blue}=====================================${colors.reset}`);
  
  // Check if we're in the right directory
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
  try {
    require(packageJsonPath);
  } catch (error) {
    log(`${colors.red}Error: Please run this script from the server directory${colors.reset}`);
    process.exit(1);
  }

  // Check environment variables
  log(`\n${colors.yellow}Checking environment configuration...${colors.reset}`);
  
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'DATABASE_URL'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`${colors.red}Missing required environment variables:${colors.reset}`);
    missingVars.forEach(varName => log(`  - ${varName}`));
    log(`\n${colors.yellow}Please ensure your .env file contains all required variables.${colors.reset}`);
    process.exit(1);
  }
  
  log(`${colors.green}✓ Environment configuration looks good${colors.reset}`);

  // Run the tests
  const testSuites = [
    {
      command: 'npm run test -- --testPathPattern=health-check.test.ts',
      description: 'Health Check Tests'
    },
    {
      command: 'npm run test -- --testPathPattern=users.test.ts',
      description: 'Users API Tests'
    },
    {
      command: 'npm run test -- --testPathPattern=compost-stands.test.ts',
      description: 'Compost Stands API Tests'
    },
    {
      command: 'npm run test -- --testPathPattern=transactions.test.ts',
      description: 'Transactions API Tests'
    },
    {
      command: 'npm run test -- --testPathPattern=events.test.ts',
      description: 'Events API Tests'
    },
    {
      command: 'npm run test -- --testPathPattern=compost-stand-admins.test.ts',
      description: 'Compost Stand Admins API Tests'
    },
    {
      command: 'npm run test -- --testPathPattern=twilio.test.ts',
      description: 'Twilio API Tests'
    }
  ];

  let passedTests = 0;
  let totalTests = testSuites.length;

  for (const testSuite of testSuites) {
    const success = runCommand(testSuite.command, testSuite.description);
    if (success) {
      passedTests++;
    }
  }

  // Summary
  log(`\n${colors.bold}${colors.blue}Test Summary${colors.reset}`);
  log(`${colors.blue}============${colors.reset}`);
  log(`Total test suites: ${totalTests}`);
  log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
  log(`Failed: ${colors.red}${totalTests - passedTests}${colors.reset}`);
  
  if (passedTests === totalTests) {
    log(`\n${colors.green}${colors.bold}🎉 All database integration tests passed!${colors.reset}`);
    log(`${colors.green}Your Supabase database is properly configured and working.${colors.reset}`);
  } else {
    log(`\n${colors.red}${colors.bold}❌ Some tests failed.${colors.reset}`);
    log(`${colors.yellow}Please check the test output above for details.${colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    log(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}
