const { Request, EventContext, DatabaseService, EntityDefinition, ApplicationService } = require("cds-internal-tool")
const { extensions: { impl: { HyperEntityHandler } } } = require("../../../../src")

module.exports = class PeopleEntityHandlers extends HyperEntityHandler {


  /**
   * 
   * @param {Request} req 
   * @param {EventContext} context 
   * @param {DatabaseService} db 
   * @param {EntityDefinition} entity
   * @param {ApplicationService} service
   * @param {Array} data
   * @param {import("express").Request} request
   * @param {import("express").Response} response
   */
  async beforeCreate(req, context, db, entity, service, data, request, response) {
    if (req === undefined) {
      throw new Error("undefined req")
    }
    if (context === undefined) {
      throw new Error("undefined context")
    }
    if (db === undefined) {
      throw new Error("undefined db")
    }
    if (entity === undefined) {
      throw new Error("undefined entity")
    }
    if (service === undefined) {
      throw new Error("undefined service")
    }
    if (data === undefined) {
      throw new Error("undefined data")
    }
    if (request === undefined) {
      throw new Error("undefined express request")
    }
    if (response === undefined) {
      throw new Error("undefined response request")
    }
    if (!(this instanceof HyperEntityHandler)) {
      throw new Error("'this' is not HyperEntityHandler")
    }
    for (const item of data) {
      if (item.Name.length <= 10) {
        return req.reject(400, "length people name is not enough")
      }
    }
  }


}
