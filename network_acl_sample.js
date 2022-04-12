/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for
 * license information.
 */
'use strict';

// Small util to validate that we have the correct environment variables set. 
function _validateEnvironmentVariables() {
    var envs = [];
    if (!process.env['AZURE_SUBSCRIPTION_ID']) envs.push('AZURE_SUBSCRIPTION_ID');
    if (!process.env['AZURE_TENANT_ID']) envs.push('AZURE_TENANT_ID');
    if (!process.env['AZURE_CLIENT_ID']) envs.push('AZURE_CLIENT_ID');
    if (!process.env['AZURE_CLIENT_OID']) envs.push('AZURE_CLIENT_OID');
    if (!process.env['AZURE_CLIENT_SECRET']) envs.push('AZURE_CLIENT_SECRET');

    if (envs.length > 0) {
        throw new Error(util.format('please set/export the following environment variables: %s', envs.toString()));
    }
}

const util = require('util');
const { ClientSecretCredential } = require("@azure/identity")
const { KeyVaultManagementClient } = require('@azure/arm-keyvault');
const { ResourceManagementClient } = require('@azure/arm-resources');
const random_id = require('./random_id');

// Sample config
const azureLocation = process.env['AZURE_LOCATION'] || 'westus';
const groupName = process.env['AZURE_RESOURCE_GROUP'] || 'azure-sample-group';

// Make sure the required environment variables are set. 
_validateEnvironmentVariables();

// Service principal details for running the sample
const subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];
const tenantId = process.env['AZURE_TENANT_ID'];
const clientId = process.env['AZURE_CLIENT_ID'];
const objectId = process.env['AZURE_CLIENT_OID'];
const secret = process.env['AZURE_CLIENT_SECRET'];

// Random sample keyvault name
const kvName = random_id();


// Uses the resource management client to create a sample resource group
// Then creates a key vault in this group with specified network ACL rules.
async function createVault(networkAcls) {
    
    const credentials = new ClientSecretCredential(tenantId,clientId,secret);
    const resourceClient = new ResourceManagementClient(credentials, subscriptionId);
    const kvManagementClient = new KeyVaultManagementClient(credentials, subscriptionId);
    try{
        // Create sample resource group.
        console.log("Creating resource group: " + groupName);
        await resourceClient.resourceGroups.createOrUpdate(groupName, { location: azureLocation });

        const kvParams = {
            location: azureLocation,
            properties: {
                sku: { 
                    family:'A',
                    name: 'standard'
                },
                networkAcls: networkAcls, // pass the network ACLs
                accessPolicies: [
                    {
                        tenantId: tenantId,
                        objectId: objectId,
                        permissions: {
                            secrets: ['all'],
                        }
                    }
                ],
                enabledForDeployment: false,
                tenantId: tenantId
            },
            tags: {}
        };
            
        console.log("Creating key vault: " + kvName);

        // Create the sample key vault using the KV management client.
        const result = await kvManagementClient.vaults.beginCreateOrUpdateAndWait(groupName, kvName, kvParams);
        console.log("Vault created with URI '" + result.properties.vaultUri + "'");
    }catch(error){
        console.log(error)
    }
    
}

// Network ACL definitions
// The only action supported for virtual network and IP rules is "allow". 
// To deny an address, set the default action to 'deny' and do not explicitly allow the address.
var networkAcls = {
    bypass: 'AzureServices', // Allows bypass of network ACLs from Azure services. Valid: 'AzureServices' or 'None'
    defaultAction: 'Deny', // Action to take if access attempt does not match any rule. 'Allow' or 'Deny'
    
    // IP rules (allowed IPv4 addresses/ranges)
    ipRules: [ 
        { 'value': '0.0.0.0/0' } // Allow access from all IPv4 addresses
    ],
    
    // Virtual network rules (Allows access to Azure Virtual Networks by their Azure Resource ID)
    // To specifically allow access to a vnet, uncomment the line below and replace the id with the corerct id value for your Vnet
    virtualNetworkRules: [
        // { 'id': '/subscriptions/subid/resourceGroups/rg1/providers/Microsoft.Network/virtualNetworks/test-vnet/subnets/subnet1' }
    ]
};
    
console.log('Creating sample Key Vault with network ACLs.');
createVault(networkAcls);