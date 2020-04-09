"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_request_1 = require("graphql-request");
exports.default = async (api_obniz_io, WebAppToken, skip = 0) => {
    const graphQLClient = new graphql_request_1.GraphQLClient(`${api_obniz_io}/v1/graphql`, {
        headers: {
            authorization: `Bearer ${WebAppToken}`,
        },
    });
    const query = `query getInstalls($skip: skip!){
    webapp{
      id,
      title,
      installs(first: 10, skip: $skip) {
        pageInfo {
          hasNextPage
        }
          edges {
          node {
            id,
            configs,
            createdAt,
            updatedAt,
            user {
              id,
              name,
              email,
              picture,
              createdAt,
              credit
            }
            devicesInConfig {
              id,
              access_token,
              hardware,
              os,
              osVersion,
              region,
              status,
              createdAt
            }
          }
        }
      }
    }
  }`;
    const variables = {
        skip,
    };
    return await graphQLClient.request(query, variables);
};
