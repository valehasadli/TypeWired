"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjectableInterface = exports.InjectableTransient = exports.InjectableSingleton = void 0;
const Container_1 = __importDefault(require("../container/Container"));
// Decorator for registering a class as a singleton
function InjectableSingleton(...dependencies) {
    return function (constructor) {
        Container_1.default.registerSingleton(constructor.name, constructor, dependencies);
    };
}
exports.InjectableSingleton = InjectableSingleton;
// Decorator for registering a class as a transient (non-singleton)
function InjectableTransient(...dependencies) {
    return function (constructor) {
        Container_1.default.registerTransient(constructor.name, constructor, dependencies);
    };
}
exports.InjectableTransient = InjectableTransient;
// Decorator for registering a class as an implementation of an interface
function InjectableInterface(token, ...dependencies) {
    return function (constructor) {
        Container_1.default.registerInterface(token, constructor, dependencies);
    };
}
exports.InjectableInterface = InjectableInterface;
