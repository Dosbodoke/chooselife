// Day counting depends on the local time zone. Pin one that observes DST so
// the 23h/25h days are exercised the same way on every machine and in CI.
process.env.TZ = "America/New_York";

module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    // Transpile only (`isolatedModules`): `tsc --noEmit` already covers types,
    // and this package is on a TypeScript newer than ts-jest type-checks with.
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          isolatedModules: true,
          module: "commonjs",
          moduleResolution: "node10",
          ignoreDeprecations: "6.0",
          rootDir: ".",
          esModuleInterop: true,
        },
      },
    ],
  },
};
