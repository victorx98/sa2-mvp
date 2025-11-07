module.exports = {
  projects: [
    {
      displayName: 'unit',
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: 'src',
      testRegex: '.*\\.spec\\.ts$',
      transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
      },
      collectCoverageFrom: ['**/*.(t|j)s'],
      coverageDirectory: '../coverage',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@domains/(.*)$': '<rootDir>/domains/$1',
        '^@application/(.*)$': '<rootDir>/application/$1',
        '^@infrastructure/(.*)$': '<rootDir>/infrastructure/$1',
        '^@api/(.*)$': '<rootDir>/api/$1',
        '^@operations/(.*)$': '<rootDir>/operations/$1',
        '^@core/(.*)$': '<rootDir>/core/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
      },
    },
    {
      displayName: 'e2e',
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: 'test',
      testEnvironment: 'node',
      testRegex: '.e2e-spec.ts$',
      transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)',
      ],
      moduleNameMapper: {
        '^@domains/(.*)$': '<rootDir>/../src/domains/$1',
        '^@application/(.*)$': '<rootDir>/../src/application/$1',
        '^@infrastructure/(.*)$': '<rootDir>/../src/infrastructure/$1',
        '^@api/(.*)$': '<rootDir>/../src/api/$1',
        '^@operations/(.*)$': '<rootDir>/../src/operations/$1',
        '^@core/(.*)$': '<rootDir>/../src/core/$1',
        '^@shared/(.*)$': '<rootDir>/../src/shared/$1',
      },
      collectCoverageFrom: [
        '../src/domains/**/*.service.ts',
        '!**/*.spec.ts',
        '!**/*.interface.ts',
        '!**/*.dto.ts',
      ],
      coverageDirectory: '../coverage-e2e',
    },
  ],
};
