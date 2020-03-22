
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
        allowUndefinedFacts: true
      };
      var engine = new Engine([], options);

      const accountClient = require('./support/account-api-client')

      const rules = JSON.parse(config.rules).rules;
      for (let index = 0; index < rules.length; index++) {
        const rule = rules[index];
        engine.addRule(rule);
      }

      /**
       * Register listeners with the engine for rule success and failure
       */
      let facts;

      const success: Array<Object> = [];
      const failure: Array<Object> = [];
      engine
        .on('success', event => {
          this.send({event, success:true})
        })
        .on('failure', event => {
          this.send({event, success:false})
        })



      /**
       * 'account-information' fact executes an api call and retrieves account data
       * - Demonstrates facts called only by other facts and never mentioned directly in a rule
       */
      engine.addFact('account-information', (params, almanac) => {
        return almanac.factValue('accountId')
          .then(accountId => {
            console.log(accountClient.getAccountInformation(accountId));
            return accountClient.getAccountInformation(accountId)
          })
      })

      /**
       * 'employee-tenure' fact retrieves account-information, and computes the duration of employment
       * since the account was created using 'accountInformation.createdAt'
       */
      engine.addFact('employee-tenure', (params, almanac) => {
        return almanac.factValue('account-information')
          .then((accountInformation: any) => {
            const created = new Date(accountInformation.createdAt)
            const now = new Date()
            switch (params.unit) {
              case 'years':
                return now.getFullYear() - created.getFullYear()
              case 'milliseconds':
              default:
                return now.getTime() - created.getTime()
            }
          })
          .catch(console.log)
      })

      // define fact(s) known at runtime
      facts = msg.payload;
console.log(facts);
      engine
        .run(facts)
        .then((resoponse) => {
          return this.send(resoponse);
        })
        .catch(console.log)
    });
  }
  RED.nodes.registerType('json-rules', RulesNode);
};
