/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  assert,
  EntityDefinition,
  EventContext,
  EventHook, isCDSRequest, Logger, memorized,
  mustBeArray, Service
} from "cds-internal-tool";
import { parseJs } from "../../base/utils";
import { CDSContextBase } from "./CDSContextBase";
import { VALUES_HOOK } from "./constants";

type AnyFunction = (...args: Array<any>) => any

export type NativeHandlerArgsExtractor = (...args: Array<any>) => { req: EventContext, data?: Array<any>, next?: any };

const NATIVE_HANDLER_ARGS_EXTRACTORS: { [key: string]: NativeHandlerArgsExtractor } = {
  [VALUES_HOOK.ON]: (req: EventContext, next: any) => {
    return { req, next, data: mustBeArray(req["data"]) };
  },
  [VALUES_HOOK.BEFORE]: (req: EventContext) => {
    return { req, data: mustBeArray(req["data"]), next: () => { } };
  },
  [VALUES_HOOK.AFTER]: (data: any, req: EventContext) => {
    return { req, data: mustBeArray(data), next: () => { } };
  },
};

export type HandlerInjectorOptions = {
  handler: AnyFunction;
  hook: EventHook;
  entity?: EntityDefinition;
  /**
   * this arg for handler when executing
   */
  thisArg?: any;
  each: boolean;
};

/**
 * get the argument parameters names from function object
 * 
 * @param {AnyFunction} f any type function, support arrow, async, plain
 * @returns {Array<string>} the arg name list of the target function
 */
export const getFunctionArgNames = memorized(function (f: AnyFunction) {

  assert.mustBeFunction(f);

  // TODO: rest arguments support
  let tree: any;
  try {
    tree = parseJs(f.toString());
  } catch (error) {
    let fString = f.toString().trimStart();
    if (fString.startsWith("async")) {
      fString = `async function ${fString.slice("async".length)}`;
    } else {
      fString = `function ${fString}`;
    }
    tree = parseJs(fString);
  }

  const params = tree.body[0]?.expression?.params ?? tree?.body?.[0]?.params;
  return params?.map((param: any) => param.name) ?? [];
});

interface InjectContextOptions<DATA = Array<any>> {
  entity?: EntityDefinition;
  service: Service;
  hook: EventHook;
  req?: EventContext;
  data?: DATA;
  providers?: Array<ParameterInjectProvider>;
  next: AnyFunction;
}

export abstract class ParameterInjectProvider<T = any> {


  /**
   * check whether the parameter could be provided by this provider
   * 
   * @param parameterName 
   */
  abstract match(parameterName: string): boolean;

  /**
   * really provision the parameter instance by name 
   * 
   * @param parameterName 
   * @param context 
   */
  abstract provide(parameterName: string, context: InjectContext): T;

}

export class InjectContext extends CDSContextBase {

  #req?: EventContext;

  #data: any;

  #entity?: EntityDefinition;

  #service: Service;

  #next?: AnyFunction;

  #logger: Logger;

  #providers: Array<ParameterInjectProvider>;

  constructor({ entity, service, hook, req, data, next, providers }: InjectContextOptions) {
    super();
    this.#entity = entity;
    this.#req = req;
    this.#data = data;
    this.#next = next;
    this.#service = service;
    this.#providers = providers ?? [];
    this.#logger = this.cds.log(
      [service?.name, hook, entity?.name].filter(v => v !== undefined).join("-")
    );
  }

  get logger() {
    return this.#logger;
  }

  get entity() {
    if (this.#entity !== undefined) {
      return this.model.definitions[this.#entity?.name];
    }
  }

  get req() {
    return this.#req;
  }

  get service() {
    return this.#service;
  }

  get model() {
    // for mtx extensibility, must get model from current context service
    return this.#service.model;
  }

  get request(): import("express").Request | undefined {
    if (isCDSRequest(this.#req)) {
      return this.#req?._?.req;
    }
  }

  get response(): import("express").Response | undefined {
    if (isCDSRequest(this.#req)) {
      return this.#req?._?.res;
    }
  }

  get data() {
    return this.#data;
  }

  get next() {
    return this.#next;
  }

  get context() {
    return this.#service["context"];
  }

  get user() { return this.#req?.user; }

  get tenant() { return this.#req?.tenant; }

  get locale() { return this.#req?.locale; }

  public getArgs(argNames: Array<string>) {
    return argNames.map((argName: string) => {
      // if built-in objects
      if (argName in this) { return this[argName]; }
      // if configurable objects
      for (const provider of this.#providers) {
        if (provider.match(argName)) { return provider.provide(argName, this); }
      }
    });
  }

}


function newInjectContext(opt: InjectContextOptions) { return new InjectContext(opt); }


/**
 * create a `cds.Service` handler which automatically inject parameters
 * 
 * @param options 
 * @returns 
 */
export function createInjectableHandler({ entity, hook, handler, thisArg, each }: HandlerInjectorOptions) {
  const argsExtractor = NATIVE_HANDLER_ARGS_EXTRACTORS[hook];

  if (argsExtractor === undefined) {
    throw new Error(`hook not supported ${hook}`);
  }

  const parameterNames = getFunctionArgNames(handler);

  const invokeHandler = (service: any, req: EventContext, data: any, next: any, thisValue: any) => {
    const ctx = newInjectContext({ entity, service, hook, req, data, next });
    return handler.apply(thisValue, ctx.getArgs(parameterNames));
  };

  return async function (...args: Array<any>): Promise<any> {
    const { req, data, next } = argsExtractor(...args);

    // @ts-ignore
    const service = this, thisValue = thisArg ?? this;

    if (each && parameterNames.includes("data")) {
      return Promise.all((data ?? []).map(item => invokeHandler(service, req, item, next, thisValue)));
    }

    return invokeHandler(service, req, data, next, thisValue);
  };


}
