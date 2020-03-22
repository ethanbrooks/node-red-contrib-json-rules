
import { Red, Node, NodeProperties } from 'node-red';

import { Engine, Rule } from 'json-rules-engine';

interface RulesProps extends NodeProperties {
  rules: string;
  rulesType: 'json';
}

module.exports = function (RED: Red) {
  function RulesNode (this: Node, config: RulesProps) {
    RED.nodes.createNode(this, config);

    this.on('input', async msg => {
      let options = {
        allowUndefinedFacts: false
      };
      let engine = new Engine([], options);

      const accountClient = require('./support/account-api-client');

      const rules = JSON.parse(config.rules).rules;
      for (let index = 0; index < rules.length; index++) {
        const rule = rules[index];
        engine.addRule(rule);
      }


      engine
        .on('success', (event, almanac) => {
          this.send({ event, passed: true });
          console.log({ event, passed: true });
          almanac.addRuntimeFact(event.type + '-passed', true);
        })
        .on('failure', (event, almanac) => {
          almanac.addRuntimeFact(event.type + '-passed', false);
          console.log({ event, passed: false })
          this.send({ event, passed: false });
        });

      /**
       * 'account-information' fact executes an api call and retrieves account data
       * - Demonstrates facts called only by other facts and never mentioned directly in a rule
       */


      engine.addFact('account-information', (params, almanac) => {
        return almanac.factValue('accountId')
          .then(accountId => {
            console.log(accountClient.getAccountInformation(accountId));
            return accountClient.getAccountInformation(accountId);
          });
      });

      /**
       * 'employee-tenure' fact retrieves account-information, and computes the duration of employment
       * since the account was created using 'accountInformation.createdAt'
       */
      engine.addFact('employee-tenure', (params, almanac) => {
        return almanac.factValue('account-information')
          .then((accountInformation: any) => {
            const created = new Date(accountInformation.createdAt);
            const now = new Date();
            switch (params.unit) {
              case 'years':
                return now.getFullYear() - created.getFullYear();
              case 'milliseconds':
              default:
                return now.getTime() - created.getTime();
            }
          })
          .catch(console.log);
      });

      // define fact(s) known at runtime
      const facts = msg.payload;
      console.log(facts);
      engine
        .run(facts)
        .then((response) => {
          return this.send(response);
        })
        .catch((error) => {
          return this.send(error);
        });
    });
  }
  RED.nodes.registerType('json-rules', RulesNode);
};
