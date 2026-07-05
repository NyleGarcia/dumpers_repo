/** @type {import('semantic-release').GlobalConfig} */
export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        writerOpts: {
          commitsSort: ['scope', 'subject'],
        },
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'scripts/bp-dumper/CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/sync-dumper-version.mjs ${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/npm',
      {
        pkgRoot: 'scripts/bp-dumper',
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'scripts/bp-dumper/version.json',
          'scripts/bp-dumper/package.json',
          'scripts/bp-dumper/CHANGELOG.md',
          'scripts/bp-dumper-go/main.go',
          'scripts/bp-dumper-py/_version.py',
        ],
        message: 'chore(release): bp-dumper ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
}
