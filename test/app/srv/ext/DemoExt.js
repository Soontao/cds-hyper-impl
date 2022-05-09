const { cwdRequireCDS } = require("cds-internal-tool")
const { extensions: { ApplicationServiceExt } } = require("../../../../src")


module.exports = class DemoAppExt extends ApplicationServiceExt {
  beforeInit() {
    this.srv.demologger = cwdRequireCDS().log(this.options.loggerName)
  }
}