const { cwdRequireCDS } = require("cds-internal-tool")
const { ApplicationServiceExt } = require("../../../../src")


module.exports = class DemoAppExt extends ApplicationServiceExt {
  beforeInit(srv) {
    srv.demologger = cwdRequireCDS().log(this.options.loggerName)
  }
}
