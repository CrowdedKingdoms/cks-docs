# Studio API Refactor

We now have a working GraphQL API that wraps our UDP replication API and offers more game ready features to our clients. It is now time to add the needed functionality that game studios need to consume our services. 

We need to add the ability for studios to:
- register their clients and get tokens clients can use to directly communicate with our UDP replication servers
- monitor their API usage 
- monitor and manage their service quotas
- monitor logs for errors
- monitor billing
- monitor server availability and performance
- provision and reserve capacity
- administrate their organization users, roles, games, etc.
- handle malicious client events like inproper API usage.

Current thoughts on database schema changes and API implementation:
- Studios will be called organizations
- Studios will be able to create an org token that is used to secure communications between studio servers and our servers.
- Studios can build games where their clients either connect to their servers or ours. So either the studio server or the clients will use our cluster. Our both.
- Studios will use their org token to create client tokens. Studios will send their clients a token that clients will use to directly connect to our servers. 
- If clients connect to just studio servers (outside of our VPCs) then studio servers will just connect to our replication servers and message traffic will be relayed through studio servers.
- Studio servers will still need to use client-specific tokens when sending messages to our servers. 
- Our UDP replication servers will use the `game_tokens` table for all authentication. Studio tokens will be used to create client tokens. Only client tokens can be used to communicate with the UDP servers. We can add more columns to the `game_tokens` table as needed to manage this. We'll also need a `server_tokens` table.
- We currently measure GraphQL and UDP API usage by CPU time, message rate count, and message rate bytes. Studios will pay for our services based on those metrics and they will need to be limited by their assigned service caps. 
- We will need to update UDP and GraphQL services on what to do when a client or studio exceeds their service quotas.
- We currently have Stripe and Paypal business accounts. Studios can pay for services using a credit card (Stripe) or their PayPal account.
- We will have a free usage tier that does not require payment information.
- Our current billing model is to require pre-payment. Studios will load up their account with cash, and then we will bill from that account as services are rendered. Clients must replenish their accounts or the service quotas will be reduced to the free tier limits.
- Unused balances can be refunded for a fee.
- Since studios will share the same public infrastructure, we will assign studios their own `map_id` for each game that uses our service. The `map_id` will be used in all API calls. We'll use this association to grant access and monitor usage.
- We use the term `apps` to refer to games or any other thing that needs its own `map_id`. Our service is useful for more than just games.
- There is an `apps` concept in the schema, but it can be refactored as needed.
- We probably should refactor `maps` into `apps` everywhere in our APIs.
- We need to flag unusual client behavior. Specifically over usage.
- since studios will use their `app_id/map_id` on all calls we need to refactor all our tables to use that and partition by that.
- Studios will us their studio token to create and manage their own users outside of our systems. We will need tables for that. Our API will also let users directly register with our system. We will need a system to associate users with studios. So in total, there are two ways for clients to be serviced, 1: through studios and 2: directly in our API. We will need to association tables necessary to handle this.
- Users who register directly will not be part of an organization initially and will also be able to be part of more than one organization since their relationships will be managed within our system and not owned by any studio. Studios will have the option of needing to approve clients. Studios will also be able to charge for clients to access their games.
- Users who are owned by studios are effectively unknown to our systems except by their tokens. We won't have their emails or passwords. Therefore, there is no conversion path for them to become directly managed by our system.
- Studios will have as many apps as they want and each can have its own usage and rate limits, pricing/billing activity, etc.


