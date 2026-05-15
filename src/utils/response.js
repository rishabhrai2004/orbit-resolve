/* Response & Error Utilities */
export const successResponse = (data, message = 'Success', status = 200) => {
  return {
    status,
    success: true,
    message,
    data,
  };
};

export const errorResponse = (message, status = 500, errors = null) => {
  return {
    status,
    success: false,
    message,
    errors,
  };
};

export const paginatedResponse = (items, total, limit, offset) => {
  return {
    items,
    pagination: {
      total,
      limit,
      offset,
      pages: Math.ceil(total / limit),
    },
  };
};
