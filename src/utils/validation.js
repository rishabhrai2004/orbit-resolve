/* Validation Utilities */
import Joi from 'joi';

export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(2).required(),
    organization_name: Joi.string().min(2).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  createRequest: Joi.object({
    title: Joi.string().required(),
    description: Joi.string(),
    type: Joi.string().required(),
    urgency: Joi.string().valid('low', 'medium', 'high').required(),
    target_resource: Joi.string(),
    policy_id: Joi.string().uuid(),
  }),

  createPolicy: Joi.object({
    name: Joi.string().required(),
    description: Joi.string(),
    threshold: Joi.string(),
    auto_approval_rate: Joi.number().min(0).max(100),
  }),
};

export const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message);
    return { valid: false, errors: messages };
  }
  return { valid: true, data: value };
};
