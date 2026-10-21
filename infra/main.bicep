targetScope = 'resourceGroup'

/*
  Timelog MCP server on Azure App Service (Linux, Node 22).

  The application is stateless — client ids, codes and access tokens are sealed with one AES key
  rather than stored — so the only state Azure holds is that key, in Key Vault. No storage
  account, no token table, no container registry.

  Deployed by .github/workflows/deploy.yml (or scripts/deploy.sh by hand).
*/

@description('Short prefix for the identity, vault and log resources.')
@minLength(3)
@maxLength(12)
param namePrefix string = 'tlmcp'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Site name. Decides the hostname and therefore PUBLIC_BASE_URL. Globally unique across azurewebsites.net.')
@minLength(2)
@maxLength(60)
param siteName string = 'impact-timelog-mcp-connector'

@description('Timelog API base URL for the organisation, e.g. https://app[X].timelog.com/<account>/api.')
@minLength(1)
param timelogBaseUrl string

@description('Base64-encoded 32-byte AES key (openssl rand -base64 32). Written to Key Vault; the site reads it through a Key Vault reference. Rotating it signs every user out.')
@secure()
param tokenEncryptionKey string

@description('Days an access token is valid before the user must paste their PAT again.')
@minValue(1)
param accessTokenTtlDays int = 30

@description('App Service plan SKU. B1 is the smallest tier with Always On.')
param appServicePlanSku string = 'B1'

// Key Vault names are global and soft-deleted names stay taken, so a bare prefix would collide.
var uniqueSuffix = take(uniqueString(resourceGroup().id), 6)
var publicBaseUrl = 'https://${siteName}.azurewebsites.net'
// Built-in role: Key Vault Secrets User.
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-identity'
  location: location
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv-${uniqueSuffix}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
  }
}

resource encryptionKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'token-encryption-key'
  properties: {
    value: tokenEncryptionKey
  }
}

resource vaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, identity.id, keyVaultSecretsUserRoleId)
  scope: vault
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${siteName}-plan'
  location: location
  sku: {
    name: appServicePlanSku
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: siteName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    // Which identity resolves the @Microsoft.KeyVault(...) setting below. Without it the platform
    // looks for a system-assigned identity, finds none, and the key resolves to an empty string.
    keyVaultReferenceIdentity: identity.id
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      // The zip is already built and installed; skip the platform's startup detection.
      appCommandLine: 'node dist/http.js'
      alwaysOn: true
      healthCheckPath: '/healthz'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      appSettings: [
        { name: 'TIMELOG_BASE_URL', value: timelogBaseUrl }
        { name: 'PUBLIC_BASE_URL', value: publicBaseUrl }
        { name: 'TOKEN_ENCRYPTION_KEY', value: '@Microsoft.KeyVault(SecretUri=${encryptionKeySecret.properties.secretUri})' }
        { name: 'ACCESS_TOKEN_TTL_DAYS', value: string(accessTokenTtlDays) }
        // The App Service front end is one reverse proxy.
        { name: 'TRUSTED_PROXY_HOPS', value: '1' }
        // No server-side npm install: it would ignore the 3-day min-release-age floor in .npmrc.
        // The deploy ships a built, already-installed package instead.
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
        { name: 'ENABLE_ORYX_BUILD', value: 'false' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
      ]
    }
  }
  // The site reads the key on first start; a start before the grant exists resolves it empty.
  dependsOn: [vaultSecretsUser]
}

// Without this the site's stdout goes nowhere durable and AppServiceConsoleLogs stays empty.
resource siteLogs 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: site
  name: 'logs'
  properties: {
    applicationLogs: {
      fileSystem: {
        level: 'Information'
      }
    }
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: site
  properties: {
    workspaceId: logs.id
    logs: [
      { category: 'AppServiceConsoleLogs', enabled: true }
      { category: 'AppServiceHTTPLogs', enabled: true }
      { category: 'AppServicePlatformLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

output webAppName string = site.name
output publicBaseUrl string = publicBaseUrl
output mcpUrl string = '${publicBaseUrl}/mcp'
output keyVaultName string = vault.name
